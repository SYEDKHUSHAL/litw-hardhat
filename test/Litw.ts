import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

const wlAddresses = [
  "0x593b94c059f37f1AF542c25A0F4B22Cd2695Fb68",
  "0x645990467105162Ca1a74b45b800b3BEcfD405e9",
];

const proof = (tree, addr) => tree.getHexProof(keccak256(addr));

describe("LITW", function () {
  async function setup() {
    const [owner, other] = await ethers.getSigners();

    const Litw = await ethers.getContractFactory("Litw");
    const litw = await Litw.deploy();

    const leafNodes = [...wlAddresses, other.address]
      .map((a) => a.toLowerCase())
      .map((a) => keccak256(a));

    const merkleTree = new MerkleTree(leafNodes, keccak256, {
      sortPairs: true,
    });

    const merkleRoot = merkleTree.getHexRoot();

    return { litw, owner, other, merkleRoot, merkleTree };
  }

  describe("Deployment", function () {
    it("Should have the right default values", async function () {
      const { litw } = await loadFixture(setup);
      expect(await litw.totalSupply()).to.equal(0);
      expect(await litw.maxSupply()).to.equal(3333);
      expect(await litw.publicPrice()).to.equal(ethers.parseEther("0.01"));
    });

    it("Airdrop", async function () {
      const { litw, owner, other } = await loadFixture(setup);
      const airdropTx = await litw.airdrop(
        [owner.address, other.address],
        [1, 2]
      );
      await airdropTx.wait();
      expect(await litw.balanceOf(owner.address)).to.equal(1);
      expect(await litw.balanceOf(other.address)).to.equal(2);
      expect(await litw.totalSupply()).to.equal(3);
    });

    it("OG mint", async function () {
      const { litw, other, merkleTree, merkleRoot } = await loadFixture(setup);

      const proofBytes = proof(merkleTree, other.address);

      await expect(litw.ogMint(proofBytes, 1)).to.be.revertedWithCustomError(
        litw,
        "SaleNotStarted()"
      );

      const ogClaimTx = await litw.setOGMintOn();
      await ogClaimTx.wait();

      const maxSupplyTx = await litw.updateMaxSupply(10);
      await maxSupplyTx.wait();

      await expect(litw.ogMint(proofBytes, 11)).to.be.revertedWithCustomError(
        litw,
        "SoldOut()"
      );

      await expect(litw.updateMaxSupply(3333)).to.be.revertedWithCustomError(
        litw,
        "AttemptedMaxSupplyIncrease()"
      );

      await expect(litw.ogMint(proofBytes, 2)).to.be.revertedWithCustomError(
        litw,
        "WhitelistUnavailable()"
      );

      const merkleTx = await litw.setWhitelistRoot(merkleRoot);
      await merkleTx.wait();

      await expect(litw.ogMint(proofBytes, 1)).to.be.revertedWithCustomError(
        litw,
        "NotWhitelisted()"
      );

      await expect(
        litw.connect(other).ogMint(proofBytes, 5)
      ).to.be.revertedWithCustomError(litw, "MintingTooMany()");

      const mintTx = await litw.connect(other).ogMint(proofBytes, 2);
      await mintTx.wait();

      expect(await litw.totalSupply()).to.equal(2);

      expect(await litw.balanceOf(other.address)).to.equal(2);

      expect(await litw.tokenURI(1)).to.equal(
        "https://ipfs.io/ipfs/QmR7ApRD42gAW8dhwHQys8hvK9GaPp6BsTLNWrCBkPhVEg/hidden.json"
      );
    });

    it("whiteListMint", async function () {
      const { litw, other, merkleTree, merkleRoot } = await loadFixture(setup);

      const proofBytes = proof(merkleTree, other.address);

      await expect(
        litw.whiteListMint(proofBytes, 1)
      ).to.be.revertedWithCustomError(litw, "SaleNotStarted()");

      const claimTx = await litw.setWhiteListMintOn();
      await claimTx.wait();

      const maxSupplyTx = await litw.updateMaxSupply(10);
      await maxSupplyTx.wait();

      await expect(
        litw.whiteListMint(proofBytes, 11)
      ).to.be.revertedWithCustomError(litw, "SoldOut()");

      await expect(litw.updateMaxSupply(3333)).to.be.revertedWithCustomError(
        litw,
        "AttemptedMaxSupplyIncrease()"
      );

      await expect(
        litw.whiteListMint(proofBytes, 1)
      ).to.be.revertedWithCustomError(litw, "WhitelistUnavailable()");

      const merkleTx = await litw.setWhitelistRoot(merkleRoot);
      await merkleTx.wait();

      await expect(
        litw.whiteListMint(proofBytes, 1)
      ).to.be.revertedWithCustomError(litw, "NotWhitelisted()");

      await expect(
        litw.connect(other).whiteListMint(proofBytes, 2)
      ).to.be.revertedWithCustomError(litw, "MintingTooMany()");

      const mintTx = await litw.connect(other).whiteListMint(proofBytes, 1);
      await mintTx.wait();

      expect(await litw.totalSupply()).to.equal(1);

      expect(await litw.balanceOf(other.address)).to.equal(1);

      expect(await litw.tokenURI(1)).to.equal(
        "https://ipfs.io/ipfs/QmR7ApRD42gAW8dhwHQys8hvK9GaPp6BsTLNWrCBkPhVEg/hidden.json"
      );
    });

    it("pubListMint", async function () {
      const { litw, other, merkleTree, merkleRoot } = await loadFixture(setup);

      const proofBytes = proof(merkleTree, other.address);

      const price = await litw.publicPrice();

      await expect(
        litw.pubListMint(proofBytes, 1, { value: price })
      ).to.be.revertedWithCustomError(litw, "SaleNotStarted()");

      const claimTx = await litw.setPubListMintOn();
      await claimTx.wait();

      const maxSupplyTx = await litw.updateMaxSupply(10);
      await maxSupplyTx.wait();

      await expect(
        litw.pubListMint(proofBytes, 11, { value: price * 11n })
      ).to.be.revertedWithCustomError(litw, "SoldOut()");

      await expect(litw.updateMaxSupply(3333)).to.be.revertedWithCustomError(
        litw,
        "AttemptedMaxSupplyIncrease()"
      );

      await expect(
        litw.pubListMint(proofBytes, 1, { value: price })
      ).to.be.revertedWithCustomError(litw, "WhitelistUnavailable()");

      const merkleTx = await litw.setWhitelistRoot(merkleRoot);
      await merkleTx.wait();

      await expect(
        litw.pubListMint(proofBytes, 1, { value: price })
      ).to.be.revertedWithCustomError(litw, "NotWhitelisted()");

      await expect(
        litw.connect(other).pubListMint(proofBytes, 2, { value: price * 2n })
      ).to.be.revertedWithCustomError(litw, "MintingTooMany()");

      await expect(
        litw.connect(other).pubListMint(proofBytes, 1, { value: price * 2n })
      ).to.be.revertedWithCustomError(litw, "InvalidEthValueSent()");

      const mintTx = await litw
        .connect(other)
        .pubListMint(proofBytes, 1, { value: price });
      await mintTx.wait();

      expect(await litw.totalSupply()).to.equal(1);

      expect(await litw.balanceOf(other.address)).to.equal(1);

      expect(await litw.tokenURI(1)).to.equal(
        "https://ipfs.io/ipfs/QmR7ApRD42gAW8dhwHQys8hvK9GaPp6BsTLNWrCBkPhVEg/hidden.json"
      );
    });

    it("publicMint", async function () {
      const { litw, other, merkleTree, merkleRoot } = await loadFixture(setup);

      const price = await litw.publicPrice();

      await expect(
        litw.publicMint(1, { value: price })
      ).to.be.revertedWithCustomError(litw, "SaleNotStarted()");

      const claimTx = await litw.setPublicMintOn();
      await claimTx.wait();

      const maxSupplyTx = await litw.updateMaxSupply(10);
      await maxSupplyTx.wait();

      await expect(
        litw.publicMint(11, { value: price * 11n })
      ).to.be.revertedWithCustomError(litw, "SoldOut()");

      await expect(litw.updateMaxSupply(3333)).to.be.revertedWithCustomError(
        litw,
        "AttemptedMaxSupplyIncrease()"
      );

      await expect(
        litw.connect(other).publicMint(2, { value: price * 2n })
      ).to.be.revertedWithCustomError(litw, "MintingTooMany()");

      await expect(
        litw.connect(other).publicMint(1, { value: price * 2n })
      ).to.be.revertedWithCustomError(litw, "InvalidEthValueSent()");

      const mintTx = await litw.connect(other).publicMint(1, { value: price });
      await mintTx.wait();

      expect(await litw.totalSupply()).to.equal(1);

      expect(await litw.balanceOf(other.address)).to.equal(1);

      expect(await litw.tokenURI(1)).to.equal(
        "https://ipfs.io/ipfs/QmR7ApRD42gAW8dhwHQys8hvK9GaPp6BsTLNWrCBkPhVEg/hidden.json"
      );

      const revealTx = await litw.switchReveal();
      await revealTx.wait();

      const baseURITx = await litw.setBaseURI("https://ipfs.io/ipfs/cid/");
      await baseURITx.wait();

      expect(await litw.tokenURI(1)).to.equal(
        "https://ipfs.io/ipfs/cid/1.json"
      );
    });

    it("withdraw", async function () {
      const { litw, owner, other } = await loadFixture(setup);

      const price = await litw.publicPrice();
      const claimTx = await litw.setPublicMintOn();
      await claimTx.wait();

      const mintTx = await litw.connect(other).publicMint(1, { value: price });
      await mintTx.wait();

      expect(await litw.balanceOf(other.address)).to.equal(1);
      expect(await litw.totalSupply()).to.equal(1);

      const currentBalance = await ethers.provider.getBalance(owner.address);

      const withdrawTx = await litw.withdraw();
      await withdrawTx.wait();

      const newBalance = await ethers.provider.getBalance(owner.address);

      expect(newBalance).to.be.gt(currentBalance);
    });
  });
});
