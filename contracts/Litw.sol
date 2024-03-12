//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/*
██╗     ███████╗ █████╗ ███╗   ██╗    ██╗███╗   ██╗████████╗ ██████╗     ████████╗██╗  ██╗███████╗    ██╗    ██╗██╗███╗   ██╗██████╗ 
██║     ██╔════╝██╔══██╗████╗  ██║    ██║████╗  ██║╚══██╔══╝██╔═══██╗    ╚══██╔══╝██║  ██║██╔════╝    ██║    ██║██║████╗  ██║██╔══██╗
██║     █████╗  ███████║██╔██╗ ██║    ██║██╔██╗ ██║   ██║   ██║   ██║       ██║   ███████║█████╗      ██║ █╗ ██║██║██╔██╗ ██║██║  ██║
██║     ██╔══╝  ██╔══██║██║╚██╗██║    ██║██║╚██╗██║   ██║   ██║   ██║       ██║   ██╔══██║██╔══╝      ██║███╗██║██║██║╚██╗██║██║  ██║
███████╗███████╗██║  ██║██║ ╚████║    ██║██║ ╚████║   ██║   ╚██████╔╝       ██║   ██║  ██║███████╗    ╚███╔███╔╝██║██║ ╚████║██████╔╝
╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝    ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝        ╚═╝   ╚═╝  ╚═╝╚══════╝     ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝╚═════╝ 
*/


import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";


error SoldOut();
error SaleNotStarted();
error MintingTooMany();
error NotWhitelisted();
error MintedOut();
error ArraysDontMatch();
error NotEnoughEthSent();
error WhitelistUnavailible();
error AttemtedMaxSupplyIncrease();



contract Litw is ERC721AQueryable, Ownable{

    uint public maxSupply = 3333;
    uint public publicPrice = 0.01 ether;
    uint public maxPerOG = 2;
    uint public maxPerWL = 1;

    string public baseURI;
    string public notRevealedURI;
    string public uriSuffix = ".json";
    bool public revealed;

    enum SaleStatus {INACTIVE, OG, WHITELIST, PUBLIST, PUBLIC}
    SaleStatus public saleStatus = SaleStatus.INACTIVE;


    bytes32 private merkleTreeRoot;
    mapping(address => uint256) public publicMintedPerwallet;



    constructor() 
    ERC721A("Lean Into The Wind", "LITW") Ownable(msg.sender)
    {
        setNotRevealedURI("https://ipfs.io/ipfs/QmR7ApRD42gAW8dhwHQys8hvK9GaPp6BsTLNWrCBkPhVEg/hidden.json");
    }



    function airdrop(address[] calldata accounts, uint[] calldata amounts) external onlyOwner {
        if(accounts.length != amounts.length) revert ArraysDontMatch();
        uint supply = totalSupply();
        for(uint i; i < accounts.length; i++){
            if(supply + amounts[i] > maxSupply) revert SoldOut();
            supply += amounts[i];
            _mint(accounts[i], amounts[i]);
        }
    }

    /*///////////////////////////////////////////////////////////////
                           MINT MECHANICS
    //////////////////////////////////////////////////////////////*/

    function ogMint(bytes32[] memory proof, uint amount) external {
        if(saleStatus != SaleStatus.OG) revert SaleNotStarted();
        if(totalSupply() + amount > maxSupply) revert SoldOut();
        //check whitelist
        if (merkleTreeRoot == 0) revert WhitelistUnavailible();
        bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
        bool isWhitelisted =  MerkleProof.processProof(proof, leaf) == merkleTreeRoot;
        if (!isWhitelisted) revert NotWhitelisted();
        //check whitelist end
        if(_numberMinted(_msgSender()) + amount > maxPerOG) revert MintingTooMany();
        _mint(_msgSender(),amount);
    }





    function whiteListMint(bytes32[] memory proof, uint amount) external {
        if(saleStatus != SaleStatus.WHITELIST) revert SaleNotStarted();
        if(totalSupply() + amount > maxSupply) revert SoldOut();
        //check whitelist
        if (merkleTreeRoot == 0) revert WhitelistUnavailible();
        bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
        bool isWhitelisted =  MerkleProof.processProof(proof, leaf) == merkleTreeRoot;
        if (!isWhitelisted) revert NotWhitelisted();
        //check whitelist end
        if(_numberMinted(_msgSender()) + amount > maxPerWL) revert MintingTooMany();
        _mint(_msgSender(),amount);
    }


    function pubListMint(bytes32[] memory proof, uint amount) external payable {
        if(saleStatus != SaleStatus.PUBLIST) revert SaleNotStarted();
        if(totalSupply() + amount > maxSupply) revert SoldOut();
        if(msg.value < amount * publicPrice) revert NotEnoughEthSent();
        //check whitelist
        if (merkleTreeRoot == 0) revert WhitelistUnavailible();
        bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
        bool isWhitelisted =  MerkleProof.processProof(proof, leaf) == merkleTreeRoot;
        if (!isWhitelisted) revert NotWhitelisted();
        //check whitelist end
        if(_numberMinted(_msgSender()) + amount > maxPerWL) revert MintingTooMany();
        _mint(_msgSender(),amount);
    }


    function publicMint(uint amount) external payable {
        if(saleStatus != SaleStatus.PUBLIC) revert SaleNotStarted();
        if(totalSupply() + amount > maxSupply) revert SoldOut();
        if(msg.value < amount * publicPrice) revert NotEnoughEthSent();

        if(publicMintedPerwallet[_msgSender()] + amount > maxPerWL) revert MintingTooMany();
        
        publicMintedPerwallet[_msgSender()] += amount;
        _mint(_msgSender(),amount);
    }


    /*///////////////////////////////////////////////////////////////
                          Switch Sale Status
    //////////////////////////////////////////////////////////////*/


    function setOGMintOn() external onlyOwner{
        saleStatus = SaleStatus.OG;
    }

    function setWhiteListMintOn() external onlyOwner{
        saleStatus = SaleStatus.WHITELIST;
    }

    function setPubListMintOn() external onlyOwner{
        saleStatus = SaleStatus.PUBLIST;
    }

    function setPublicMintOn() external onlyOwner{
        saleStatus = SaleStatus.PUBLIC;
    }

    function turnSalesOff() external onlyOwner{
        saleStatus = SaleStatus.INACTIVE;
    }


    /*///////////////////////////////////////////////////////////////
                                UTILS
    //////////////////////////////////////////////////////////////*/


    function setNotRevealedURI(string memory _notRevealedURI) public onlyOwner {
        notRevealedURI = _notRevealedURI;
    }

    function setBaseURI(string memory _baseURI) external onlyOwner{
        baseURI = _baseURI;
    }

    function switchReveal() external onlyOwner {
        revealed = !revealed;
    }

    function setUriSuffix(string memory _uriSuffix) external onlyOwner {
        uriSuffix = _uriSuffix;
    }

    function updatePublicPrice(uint _newPrice) external onlyOwner {
        publicPrice = _newPrice;
    }

    function setWhitelistRoot(bytes32 _root) external onlyOwner {
        merkleTreeRoot = _root;
    }

    function setMaxPerOG(uint _maxPerOG) external onlyOwner {
        maxPerOG = _maxPerOG;
    }
    
    function setMaxPerWL(uint _maxPerWL) external onlyOwner {
        maxPerWL = _maxPerWL;
    }
    

    function updateMaxSupply(uint _maxSupply) external onlyOwner {
        if(_maxSupply > maxSupply) revert AttemtedMaxSupplyIncrease();
        maxSupply = _maxSupply;
    }


    /*///////////////////////////////////////////////////////////////
                            METADATA FACTORY
    //////////////////////////////////////////////////////////////*/


    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721A, IERC721A)
        returns (string memory)
    {
        if (revealed == false) {
            return notRevealedURI;
        }

        string memory currentBaseURI = baseURI;
        return
            bytes(currentBaseURI).length > 0
                ? string(abi.encodePacked(currentBaseURI, _toString(tokenId),uriSuffix))
                : "";
    }

    /*///////////////////////////////////////////////////////////////
                            WITHDRAWAL METHOD
    //////////////////////////////////////////////////////////////*/

    function withdraw() public payable onlyOwner {
        (bool os, ) = payable(owner()).call{value: address(this).balance}("");
        require(os);
    }

}


