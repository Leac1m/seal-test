module smc::smc;

const ENotNum: u64 = 1;
public fun seal_approve(num: u64){
    assert!(num==1, ENotNum);
}
